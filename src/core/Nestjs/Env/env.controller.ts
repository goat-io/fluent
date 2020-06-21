import { Controller, Get, Patch, Body } from '@nestjs/common'
import { ApiTags, ApiResponse, ApiBody } from '@nestjs/swagger'
import { ConfigService } from '@nestjs/config'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { parse, stringify } from 'envfile'

interface EnvFile {
  [key: string]: string
}

@ApiTags('Env')
@Controller('env')
export class EnvController {
  constructor(private configService: ConfigService) {}

  @Get()
  getCurrentConfiguration() {
    const rootPath = this.configService.get<string>('rootPath')
    const text = readFileSync(join(rootPath, '.env'), 'utf8')
    const parsedEnv = parse(text) || {}
    return parsedEnv
  }

  @Patch()
  @Patch(':id')
  @ApiResponse({
    status: 200,
    description: 'The created env file'
  })
  @ApiBody({
    description: 'Env file'
  })
  async updateEnvFile(@Body() newVariables: EnvFile): Promise<EnvFile> {
    const rootPath = this.configService.get<string>('rootPath')
    const text = readFileSync(join(rootPath, '.env'), 'utf8')
    const parsedEnv = (parse(text) || {}) as EnvFile
    const updatedValue = { ...parsedEnv, ...newVariables }
    const newEnv = stringify(updatedValue)

    writeFileSync(join(rootPath, '.env'), newEnv)

    return updatedValue
  }

  @Patch(':id')
  @ApiResponse({
    status: 200,
    description: 'The created env file'
  })
  @ApiBody({
    description: 'Env file'
  })
  async updateEnvFilePatch(@Body() newVariables: EnvFile): Promise<EnvFile> {
    const rootPath = this.configService.get<string>('rootPath')
    const text = readFileSync(join(rootPath, '.env'), 'utf8')
    const parsedEnv = (parse(text) || {}) as EnvFile
    const updatedValue = { ...parsedEnv, ...newVariables }
    const newEnv = stringify(updatedValue)

    writeFileSync(join(rootPath, '.env'), newEnv)

    return updatedValue
  }
}
