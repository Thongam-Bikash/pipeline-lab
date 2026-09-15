import type { ComponentProps } from 'react'

// Lesson prose uses the same measure and rhythm everywhere, set in one place.
export const mdxComponents = {
  h2: (props: ComponentProps<'h2'>) => <h2 className="mt-10 text-xl font-semibold" {...props} />,
  h3: (props: ComponentProps<'h3'>) => <h3 className="mt-6 font-semibold" {...props} />,
  p: (props: ComponentProps<'p'>) => <p className="mt-4" {...props} />,
  ul: (props: ComponentProps<'ul'>) => <ul className="mt-4 list-disc space-y-1 pl-5" {...props} />,
  ol: (props: ComponentProps<'ol'>) => <ol className="mt-4 list-decimal space-y-1 pl-5" {...props} />,
  a: (props: ComponentProps<'a'>) => <a className="text-signal underline underline-offset-4" {...props} />,
  code: (props: ComponentProps<'code'>) => <code className="rounded-base bg-surface px-1 py-0.5 font-mono text-[0.9em]" {...props} />,
  strong: (props: ComponentProps<'strong'>) => <strong className="font-semibold" {...props} />,
}
