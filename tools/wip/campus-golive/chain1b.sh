#!/bin/bash
SP=/tmp/claude-0/-home-user/c41d5321-7fd8-5327-b7c4-485ab1f2a414/scratchpad/stg
cd $SP/cp10 && SEEDS=4 timeout 3000 node --test --test-name-pattern="CP-10" tests/campus-tickets.test.js > $SP/cp10-own3.log 2>&1; echo "EXIT $?" >> $SP/cp10-own3.log
cd $SP/t10 && KINDS=node SEEDS=4 timeout 3000 python3 tools/plants-campus-tickets.py "CP-10: an address set by hand counts" >> $SP/pl-fix.log 2>&1
grep -q "CAUGHT · node · CP-10: an address set by hand counts" $SP/pl-fix.log && { cd $SP && nohup bash $SP/orch2.sh > $SP/orch2.out 2>&1 & echo "$(date +%H:%M) orch2 started again (26 November): CP-10's fixed plant caught on its re-patched tree" >> $SP/orch.log; }
cd $SP/t12 && KINDS=node SEEDS=4 timeout 3000 python3 tools/plants-campus-tickets.py "CP-12: the file right but the service not restarted counts" >> $SP/pl-fix.log 2>&1
cd $SP/cp12 && SEEDS=4 timeout 3000 node --test --test-name-pattern="CP-12" tests/campus-tickets.test.js > $SP/cp12-own3.log 2>&1; echo "EXIT $?" >> $SP/cp12-own3.log
cd $SP/t12 && KINDS=node SEEDS=4 timeout 3000 python3 tools/plants-campus-tickets.py "CP-12: dhcpd starts on a file with a mistake" >> $SP/pl-node-c.log 2>&1
cd $SP/tp && KINDS=node SEEDS=4 timeout 6000 python3 tools/plants-campus-tickets.py "CP-13:" "CP-14:" >> $SP/pl-node-c.log 2>&1
echo "$(date +%H:%M) chain1b done" >> $SP/chain.log
