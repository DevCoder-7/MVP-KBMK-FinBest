#!/bin/bash
# Auto-restart dev server if it crashes
cd /home/z/my-project

while true; do
  echo "[$(date +%H:%M:%S)] Starting dev server..."
  bun run dev > dev.log 2>&1 &
  PID=$!
  
  # Wait for server to be ready
  for i in $(seq 1 30); do
    sleep 2
    if curl -s --max-time 3 -o /dev/null http://localhost:3000 2>/dev/null; then
      echo "[$(date +%H:%M:%S)] Server ready (PID $PID)"
      break
    fi
    # Check if process died
    if ! ps -p $PID > /dev/null 2>&1; then
      echo "[$(date +%H:%M:%S)] Process died during startup"
      break
    fi
  done
  
  # Wait for process to exit
  wait $PID 2>/dev/null
  echo "[$(date +%H:%M:%S)] Server exited, restarting in 3s..."
  sleep 3
done
