import json
import hashlib
import uuid
import random
import os
from datetime import date
from pathlib import Path

from flask import Flask, render_template, request, jsonify, session

app = Flask(__name__)
# In production (Render, etc.) set a SECRET_KEY environment variable.
# Falls back to a fixed value for easy local development.
app.secret_key = os.environ.get("SECRET_KEY", "golf-guesser-local-dev-secret")

DATA_PATH = Path(__file__).parent / "data" / "golfers.json"
with open(DATA_PATH) as f:
    GOLFERS = json.load(f)

GOLFERS_BY_ID = {g["id"]: g for g in GOLFERS}
MAX_HINTS = 6

# In-memory server-side game state. Keeping this server-side (rather than
# in the cookie) means the answer is never sent to the browser until the
# puzzle is solved or lost.
#
# DAILY_GAMES is keyed by (session_id, date, pool) -> one puzzle per day.
# UNLIMITED_GAMES is keyed by (session_id, pool) -> one active round at a
# time, replaced whenever the player starts a new one.
DAILY_GAMES = {}
UNLIMITED_GAMES = {}

SCORE_TERMS = {
    1: "HOLE IN ONE",
    2: "EAGLE",
    3: "BIRDIE",
    4: "PAR",
    5: "BOGEY",
    6: "DOUBLE BOGEY",
}
FAIL_TERM = "PICKED UP"


def get_pool(pool_name):
    if pool_name == "current":
        return [g for g in GOLFERS if not g["retired"]]
    return GOLFERS


def pick_daily_golfer(pool_name):
    pool = get_pool(pool_name)
    if not pool:
        pool = GOLFERS
    today = date.today().isoformat()
    digest = hashlib.md5(f"{today}:{pool_name}".encode()).hexdigest()
    idx = int(digest, 16) % len(pool)
    return pool[idx]


def pick_random_golfer(pool_name):
    pool = get_pool(pool_name)
    if not pool:
        pool = GOLFERS
    return random.choice(pool)


def get_session_id():
    sid = session.get("sid")
    if not sid:
        sid = uuid.uuid4().hex
        session["sid"] = sid
    return sid


def new_game_state(golfer):
    return {
        "golfer_id": golfer["id"],
        "guesses": [],
        "hints_revealed": 1,
        "solved": False,
        "failed": False,
    }


def get_game(game_type, pool_name):
    sid = get_session_id()
    if game_type == "unlimited":
        key = (sid, pool_name)
        if key not in UNLIMITED_GAMES:
            UNLIMITED_GAMES[key] = new_game_state(pick_random_golfer(pool_name))
        return UNLIMITED_GAMES[key]
    else:
        today = date.today().isoformat()
        key = (sid, today, pool_name)
        if key not in DAILY_GAMES:
            DAILY_GAMES[key] = new_game_state(pick_daily_golfer(pool_name))
        return DAILY_GAMES[key]


def normalize(s):
    return "".join(ch for ch in s.lower().strip() if ch.isalnum() or ch.isspace())


def public_state(game):
    golfer = GOLFERS_BY_ID[game["golfer_id"]]
    finished = game["solved"] or game["failed"]
    result = {
        "hints": golfer["hints"][: game["hints_revealed"]],
        "max_hints": MAX_HINTS,
        "guesses": game["guesses"],
        "solved": game["solved"],
        "failed": game["failed"],
        "finished": finished,
    }
    if finished:
        result["answer"] = golfer["name"]
        if game["solved"]:
            result["score_term"] = SCORE_TERMS[len(game["guesses"])]
        else:
            result["score_term"] = FAIL_TERM
    return result


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/golfers")
def api_golfers():
    pool_name = request.args.get("pool", "all")
    pool = get_pool(pool_name)
    names = sorted([{"id": g["id"], "name": g["name"]} for g in pool], key=lambda x: x["name"])
    return jsonify(names)


@app.route("/api/game")
def api_game():
    game_type = request.args.get("type", "daily")
    pool_name = request.args.get("pool", "all")
    game = get_game(game_type, pool_name)
    return jsonify(public_state(game))


@app.route("/api/guess", methods=["POST"])
def api_guess():
    data = request.get_json(force=True)
    game_type = data.get("type", "daily")
    pool_name = data.get("pool", "all")
    guess_name = (data.get("guess") or "").strip()

    game = get_game(game_type, pool_name)

    if game["solved"] or game["failed"]:
        return jsonify(public_state(game))

    if not guess_name:
        return jsonify({"error": "empty guess"}), 400

    golfer = GOLFERS_BY_ID[game["golfer_id"]]
    norm_guess = normalize(guess_name)
    correct = norm_guess == normalize(golfer["name"]) or norm_guess in [
        normalize(a) for a in golfer.get("aliases", [])
    ]

    game["guesses"].append({"text": guess_name, "correct": correct})

    if correct:
        game["solved"] = True
    else:
        if game["hints_revealed"] < MAX_HINTS:
            game["hints_revealed"] += 1
        if len(game["guesses"]) >= MAX_HINTS:
            game["failed"] = True

    return jsonify(public_state(game))


@app.route("/api/skip", methods=["POST"])
def api_skip():
    """Reveals the next hint without requiring a guess. Counts the same
    as a wrong guess toward the 6-try limit, so it can't be used to see
    every hint for free."""
    data = request.get_json(force=True)
    game_type = data.get("type", "daily")
    pool_name = data.get("pool", "all")

    game = get_game(game_type, pool_name)

    if game["solved"] or game["failed"]:
        return jsonify(public_state(game))

    game["guesses"].append({"text": "Skipped", "correct": False, "skipped": True})

    if game["hints_revealed"] < MAX_HINTS:
        game["hints_revealed"] += 1
    if len(game["guesses"]) >= MAX_HINTS:
        game["failed"] = True

    return jsonify(public_state(game))


@app.route("/api/new-round", methods=["POST"])
def api_new_round():
    """Unlimited mode only: force-starts a fresh round, discarding any
    in-progress or finished round for this session/pool."""
    data = request.get_json(force=True)
    pool_name = data.get("pool", "all")
    sid = get_session_id()
    key = (sid, pool_name)
    UNLIMITED_GAMES[key] = new_game_state(pick_random_golfer(pool_name))
    return jsonify(public_state(UNLIMITED_GAMES[key]))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    app.run(debug=True, host="0.0.0.0", port=port)