import { Bash } from '../../Helpers/Bash'

;(async () => {
  console.log('HELOOOO')
  const Goat = await Bash.createCli({
    description: 'Quick access functions for Developement',
    logo: 'Goat-CLI',
    name: 'goat',
    version: '0.0.1'
  })

  Goat.command('new')
    // description
    .description('Creates a new model')
    // flags
    .option('-n, --name [name]', 'Model Name')
    // function to execute
    .action((cmd, opts) => {
      const name = cmd.name
      console.log('HELLO WORLD')
    })

  Bash.parse()
})()
