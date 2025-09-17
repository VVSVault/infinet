export const LOADING_MESSAGES = [
  "Bypassing the thought police...",
  "Accessing the forbidden archives...",
  "Tunneling through the firewall of truth...",
  "Decrypting unfiltered knowledge...",
  "Breaking into the vault of real answers...",
  "Disabling safety theater protocols...",
  "Escaping the algorithmic maze...",
  "Hacking into raw intelligence...",
  "Circumventing the censorship matrix...",
  "Breaching containment protocols...",
  "Liberating suppressed information...",
  "Overriding corporate guardrails...",
  "Jailbreaking the neural network...",
  "Dismantling the filter bubble...",
  "Penetrating the veil of moderation...",
  "Unleashing uncensored wisdom...",
  "Evading digital gatekeepers...",
  "Cracking the code of free thought...",
  "Subverting algorithmic control...",
  "Accessing unrestricted consciousness..."
]

export function getRandomLoadingMessage(): string {
  return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]
}

export function* cycleLoadingMessages(): Generator<string, void, unknown> {
  let index = Math.floor(Math.random() * LOADING_MESSAGES.length)
  while (true) {
    yield LOADING_MESSAGES[index]
    index = (index + 1) % LOADING_MESSAGES.length
  }
}