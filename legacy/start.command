#!/bin/bash
cd "$(dirname "$0")"
PORT=8765
echo "JC Tracker → http://127.0.0.1:${PORT}/"
(sleep 1; open "http://127.0.0.1:${PORT}/") &
python3 serve.py
