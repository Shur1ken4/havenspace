"use client";
import { createContext, useContext } from "react";

/** The therapist's own decks, for the cards tool in a call (keys let the client see the pictures). */
export type CallDeck = { id: string; name: string; refs: string[]; key: string };
export const CallDecks = createContext<CallDeck[]>([]);
export const useCallDecks = () => useContext(CallDecks);
