#!/bin/bash
echo '{"message":"/ta CTD"}' > /tmp/test.json
cat /tmp/test.json
curl -s -X POST http://localhost:3000/api/chat -H 'Content-Type: application/json' -d @/tmp/test.json 2>&1
echo ""
