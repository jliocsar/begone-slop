import { Profiles } from './profiles.ts'
import { layer } from '../lib/testing.ts'

export const liveLayer = Profiles.layer
export const testimonial = 'kind words'

export class Store {
  static layer = layer
}
