import { describe, expect, it } from 'vitest'
import { allLessons, modules } from './modules'

describe('content', () => {
  it('has at least one module, each with lessons and a unique slug', () => {
    expect(modules.length).toBeGreaterThan(0)
    expect(new Set(modules.map((module) => module.slug)).size).toBe(modules.length)
    for (const module of modules) {
      expect(module.lessons.length, `${module.slug} has no lessons`).toBeGreaterThan(0)
      expect(module.title).not.toBe('')
      expect(module.summary).not.toBe('')
    }
  })

  it.each(allLessons.map((lesson) => [lesson.id, lesson] as const))('%s records when it was last verified', (_, lesson) => {
    expect(Number.isNaN(Date.parse(lesson.lastVerified)), `${lesson.id} has an unreadable lastVerified`).toBe(false)
    expect(lesson.sources.length, `${lesson.id} cites no source`).toBeGreaterThan(0)
    for (const source of lesson.sources) expect(source).toMatch(/^https:\/\//)
    expect(lesson.minutes).toBeGreaterThan(0)
  })

  it.each(allLessons.map((lesson) => [lesson.id, lesson] as const))('%s asks three to five questions', (_, lesson) => {
    const { questions } = lesson.quiz
    expect(questions.length, `${lesson.id} has ${questions.length} questions`).toBeGreaterThanOrEqual(3)
    expect(questions.length).toBeLessThanOrEqual(5)
    for (const question of questions) {
      expect(question.choices.length).toBeGreaterThanOrEqual(2)
      expect(question.answer).toBeGreaterThanOrEqual(0)
      expect(question.answer).toBeLessThan(question.choices.length)
      expect(question.explain, `${lesson.id} explains nothing for "${question.prompt}"`).not.toBe('')
    }
  })

  it.each(allLessons.map((lesson) => [lesson.id, lesson] as const))('%s compiles', async (_, lesson) => {
    const loaded = await lesson.load()
    expect(typeof loaded.default).toBe('function')
  })

  it.each(modules.map((module) => [module.slug, module] as const))('%s has a recap', async (_, module) => {
    const loaded = await module.loadRecap()
    expect(typeof loaded.default).toBe('function')
  })
})
