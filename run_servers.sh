NUM_NODES=$2
for (( c=1; c<=NUM_NODES; c++ ))
do
  java -jar -Xmx512m "$1" "$2" &
done