export interface CredentialItem {
  id: string;
  label: string;
  value: string;
  /** Passwords are hidden by default. Everything else is always visible. */
  secret: boolean;
}

export interface SpaceshipCredentials {
  username: string;
  password: string;
}

export const keysIntro: string[] = [
  "These are yours.",
  "Set up, and waiting.",
  "A brother leaving keys under the mat.",
];

export const credentialCards: CredentialItem[] = [
  { id: "website", label: "Website", value: "https://jbsh.me", secret: false },
  { id: "apple-id", label: "Apple ID", value: "jbsh.me@icloud.com", secret: false },
];

export const spaceshipCredentials: SpaceshipCredentials = {
  username: "jbsh.me@icloud.com",
  password: "poloko123!",
};
