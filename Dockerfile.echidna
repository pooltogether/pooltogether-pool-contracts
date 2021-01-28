FROM trailofbits/eth-security-toolbox
WORKDIR /src
RUN solc-select 0.6.12
ENTRYPOINT /usr/local/bin/echidna-test . --config echidna.yaml --contract EchidnaTokenFaucet