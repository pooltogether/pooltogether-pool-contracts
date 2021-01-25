const users = {
  'dai': [
    '0xe4f80b148e9d4f2c47ff5d25c6f4a5b0c44b10d5',
    '0x7124ad6d626b2879ed5f4cd24ab922a1918e218b',
    '0x5a36a417f7b4ec976eb9fc1e1e01e67585d7251c',
    '0x1d5733a402962a8317da8c96e39a258436457fed',
    '0xd078381603d7a21f71dc6b95c2ea6822891bb0b7',
    '0xa7d41f49dadca972958487391d4461a5d0e1c3e9',
    '0x0e00df1dffc40e59235ea0cd3856177cb1da05ab',
    '0xebf02ca203706dc8429255cde8d621815a895960',
    '0xf1c6a281452fedeada164731895b1a38b5476516',
    '0x06f65d5e97b796e47263110f305d005b2733cd1a'  
  ],
  'usdc': [
    '0xfecde31d7ccf74927ad6c9beb65a465d1ade188f',
    '0x0c517e1fa56919ec0cec16f9dbeb2557bd93bf33',
    '0xe0f4217390221af47855e094f6e112d43c8698fe',
    '0x5351518f62e061b7fdb1a99ba025b30218ff981f',
    '0x7c7c13f1b16f3f979b7e1a1a9215e2e4e0bceaa8',
    '0xcf88fa6ee6d111b04be9b06ef6fad6bd6691b88c',
    '0xda046a2e3f8c624f9aa25a7852f0962f66cf49f3',
    '0x683cec3065994ef0d0d74f31c486ea755cb1d816',
    '0x74a5c89b08e7e719384ea230591187d041f68c88'
  ],
  'sai': [
    '0xc852f3da879c25b0e06093dcd84b8dd21a43ada9',
    '0xda8b9d10bed01484f6463ffc9ee1d9372182cda8'
  ]
}

function fetchUsers(type = 'dai') {
  return users[type.toLowerCase()]
}

module.exports = {
  fetchUsers
}