import * as animejs from 'animejs'

let animejsInstance: typeof animejs | null = null

export async function getAnimejs() {
  if (!animejsInstance) {
    animejsInstance = await import('animejs')
  }
  return animejsInstance
}

export async function animate(
  targets: any,
  props: any
): Promise<any> {
  const anime = await getAnimejs()
  return anime.animate(targets, props)
}

export function useAnimate() {
  return animate
}
