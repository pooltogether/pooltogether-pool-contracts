/**
 * @name chainid
 */
 task("prizeSplits")
 .addPositionalParam("address", "Contract address")
 .setAction(async function ({ address }) {
  const contract = await ethers.getContractAt("MultipleWinners", address);
  const prizeSplits = await contract.prizeSplits();
  console.log(prizeSplits, 'prizeSplits')

  return prizeSplits
});

task("set-prizeSplits")
.addPositionalParam("address", "Contract address")
.setAction(async function ({ address }) {
 const contract = await ethers.getContractAt("MultipleWinners", address);

 const firstPrizeSplitConfigs = [
  {
    target: '0x05dB4BE3A9D6F08230254EC9693Bbef0C9de3858',
    percentage: "100",
    token: 0,
  },
];

 const prizeSplits = await contract.setPrizeSplit(firstPrizeSplitConfigs);
 console.log("Sucess", prizeSplits)

 return prizeSplits
});
