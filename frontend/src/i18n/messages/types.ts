import type vi from "./vi";

/** Widen literal strings so other languages can have different text but must keep the same keys. */
type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

export type Messages = Widen<typeof vi>;

/** Dot-separated paths of every string in the dictionary, e.g. "auth.login.title". */
type Paths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Paths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageKey = Paths<Messages>;
