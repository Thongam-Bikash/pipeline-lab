import { useState } from 'react'
import { Button } from '@/components/ui/Button/Button'
import type { Quiz as QuizContent } from '@/content/types'

type Props = { quiz: QuizContent; onFinish: (score: number) => void }

export function Quiz({ quiz, onFinish }: Props) {
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState<number>()
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)

  const question = quiz.questions[index]
  if (!question) return null

  const answered = chosen !== undefined
  const isLast = index === quiz.questions.length - 1

  const choose = (choice: number) => {
    if (answered) return
    setChosen(choice)
    if (choice === question.answer) setCorrect((count) => count + 1)
  }

  const next = () => {
    if (isLast) {
      const score = Math.round(((correct + (chosen === question.answer ? 0 : 0)) / quiz.questions.length) * 100)
      setDone(true)
      onFinish(score)
      return
    }
    setIndex((current) => current + 1)
    setChosen(undefined)
  }

  if (done) {
    const score = Math.round((correct / quiz.questions.length) * 100)
    return (
      <div className="rounded-base border border-rule p-4">
        <h3 className="font-semibold">
          {correct} of {quiz.questions.length} correct
        </h3>
        <p className="mt-1 text-sm text-muted">{score === 100 ? 'Every answer right.' : 'Read back over the parts you missed, then carry on.'}</p>
      </div>
    )
  }

  return (
    <div className="rounded-base border border-rule p-4">
      <p className="text-xs text-muted">
        Question {index + 1} of {quiz.questions.length}
      </p>
      <h3 className="mt-1 font-semibold">{question.prompt}</h3>

      <ul className="mt-3 space-y-2">
        {question.choices.map((choice, position) => {
          const isAnswer = position === question.answer
          const isChosen = position === chosen
          const tone = !answered ? 'border-rule' : isAnswer ? 'border-go text-go' : isChosen ? 'border-stop text-stop' : 'border-rule text-muted'
          return (
            <li key={choice}>
              <button
                type="button"
                onClick={() => choose(position)}
                disabled={answered}
                aria-pressed={isChosen}
                className={`w-full rounded-base border px-3 py-2 text-left text-sm ${tone}`}
              >
                {choice}
                {answered && isAnswer ? ' — correct' : ''}
                {answered && isChosen && !isAnswer ? ' — not this one' : ''}
              </button>
            </li>
          )
        })}
      </ul>

      {answered ? (
        <div className="mt-3">
          <p className="text-sm">{question.explain}</p>
          <Button variant="primary" className="mt-3" onClick={next}>
            {isLast ? 'Finish' : 'Next question'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
