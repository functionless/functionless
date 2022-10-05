import React from "react";

export interface Feature {
  key?: string
  title: string;
  points: Array<{ title: string; body: string }>;
  side?: "left" | "right"
  aside?: ({scrollFactor}: {scrollFactor: number})=>React.ReactElement
  footer?: ()=>React.ReactElement
}