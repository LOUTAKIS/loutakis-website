/** "1 Bed", "2 Beds" — one place so every listing panel agrees. */
export function plural(n: number, one: string, many = one + "s"): string {
  return n === 1 ? one : many;
}
