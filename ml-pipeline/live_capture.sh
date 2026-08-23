#!/bin/bash
# ─────────────────────────────────────────────────────────
# Live Capture Pipeline
# Captures traffic → extracts features → sends to dashboard
# Run with: sudo bash live_capture.sh
# ─────────────────────────────────────────────────────────

CAPTURE_SECONDS=10
INTERFACE="uesimtun0"          # 5G tunnel interface from UERANSIM
DASHBOARD_URL="http://localhost:3000/api/capture"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMP_PCAP="/tmp/live_5g_capture.pcap"
TEMP_JSON="/tmp/live_5g_features.json"

echo "╔══════════════════════════════════════════╗"
echo "║  5G Live Capture Pipeline                ║"
echo "║  Interface: $INTERFACE                   ║"
echo "║  Capture window: ${CAPTURE_SECONDS}s     ║"
echo "║  Dashboard: $DASHBOARD_URL               ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check if interface exists
if ! ip link show "$INTERFACE" &>/dev/null; then
    echo "[!] Interface $INTERFACE not found."
    echo "    Make sure UERANSIM UE is running."
    echo "    Falling back to 'any' interface..."
    INTERFACE="any"
fi

CYCLE=1
while true; do
    echo "──── Cycle $CYCLE ────"
    
    # 1. Capture traffic
    echo "[1/3] Capturing traffic on $INTERFACE for ${CAPTURE_SECONDS}s..."
    sudo timeout $CAPTURE_SECONDS tcpdump -i "$INTERFACE" -w "$TEMP_PCAP" -q 2>/dev/null
    
    # Check if pcap has data
    if [ ! -s "$TEMP_PCAP" ]; then
        echo "      No traffic captured. Retrying..."
        sleep 2
        continue
    fi
    
    # 2. Extract features
    echo "[2/3] Extracting features..."
    python3 "$SCRIPT_DIR/extract_features.py" "$TEMP_PCAP" > "$TEMP_JSON" 2>/dev/null
    
    # Check if features were extracted
    FLOW_COUNT=$(python3 -c "import json; print(len(json.load(open('$TEMP_JSON'))))" 2>/dev/null)
    if [ "$FLOW_COUNT" = "0" ] || [ -z "$FLOW_COUNT" ]; then
        echo "      No flows extracted. Retrying..."
        sleep 2
        continue
    fi
    echo "      Extracted $FLOW_COUNT flows"
    
    # 3. Send to dashboard
    echo "[3/3] Sending to dashboard..."
    RESPONSE=$(curl -s -X POST "$DASHBOARD_URL" \
        -H "Content-Type: application/json" \
        -d @"$TEMP_JSON")
    
    echo "      Response: $RESPONSE"
    echo ""
    
    # Cleanup
    rm -f "$TEMP_PCAP" "$TEMP_JSON"
    
    CYCLE=$((CYCLE + 1))
done
