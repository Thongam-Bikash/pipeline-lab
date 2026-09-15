import type { Scenario } from './types'
import { threeAmJob } from './three-am-job'
import { worksOnMyMachine } from './works-on-my-machine'

export const scenarios: Scenario[] = [worksOnMyMachine, threeAmJob].sort((a, b) => a.order - b.order)

export const findScenario = (id: string): Scenario | undefined => scenarios.find((scenario) => scenario.id === id)

export const scenariosForModule = (moduleSlug: string): Scenario[] => scenarios.filter((scenario) => scenario.moduleSlug === moduleSlug)
