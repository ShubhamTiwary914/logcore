cd ..

task worker-main -- boiler 1 > /dev/null 2>&1 &
task worker-main -- greenhouse 2 > /dev/null 2>&1 &
task worker-main -- logistics 3 > /dev/null 2>&1 &