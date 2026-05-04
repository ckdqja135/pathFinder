import type { EventSource } from "../types";
import { itConferenceSeeds } from "./it";
import { designConferenceSeeds } from "./design";
import { marketingConferenceSeeds } from "./marketing";
import { financeConferenceSeeds } from "./finance";
import { businessConferenceSeeds } from "./business";
import { mediaConferenceSeeds } from "./media";
import { publicConferenceSeeds } from "./public";
import { researchConferenceSeeds } from "./research";

// 분야별 정기 컨퍼런스/시험/공모전 시드를 한 EventSource로 묶는다.
// 각 분야 파일은 손으로 큐레이션한 잠정 일정 — 매년 공식 공지가 나오면 갱신.
export const conferencesSource: EventSource = {
  name: "conferences",
  async collect() {
    return [
      ...itConferenceSeeds,
      ...designConferenceSeeds,
      ...marketingConferenceSeeds,
      ...financeConferenceSeeds,
      ...businessConferenceSeeds,
      ...mediaConferenceSeeds,
      ...publicConferenceSeeds,
      ...researchConferenceSeeds,
    ];
  },
};
