set title "Cost Plot"
set xlabel "Prize Period Fraction"
set ylabel "Early Exit Fee"

set xr [0.0:1.0]
set yrange [0.0:100.0]

level = 1

plot level - x
