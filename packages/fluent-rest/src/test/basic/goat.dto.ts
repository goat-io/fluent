import { GoatEntity } from './goat.entity'
import { InputType, OmitType } from '@goatlab/fluent'

@InputType()
export class GoatEntityOut extends OmitType(GoatEntity, [] as const) {}
/**
 *
 */
// tslint:disable-next-line: max-classes-per-file
@InputType()
export class GoatEntityIn extends OmitType(GoatEntity, ['id'] as const) {}
