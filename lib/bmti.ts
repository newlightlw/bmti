import bank from "./questions.json";
export const VERSION = "BMTI-0.2";
export const endpoints = ["V", "R", "T", "A", "S", "F", "I", "C"] as const;
export type Endpoint = (typeof endpoints)[number];
export type Question = { id: string; text: string; endpoint: Endpoint };
export const questions = bank as Question[];
export const endpointNames: Record<Endpoint, string> = {
  V: "愿景",
  R: "实效",
  T: "想清",
  A: "试做",
  S: "有序",
  F: "灵活",
  I: "自主",
  C: "协作",
};
export const roles: Record<string, string> = {
  VTSI: "灯塔守望者",
  VTSC: "星图绘制师",
  VTFI: "旷野哲思者",
  VTFC: "篝火说书人",
  VASI: "长路朝圣者",
  VASC: "晨光领航员",
  VAFI: "追风探险家",
  VAFC: "逐光同行者",
  RTSI: "山城建筑师",
  RTSC: "远征参谋官",
  RTFI: "迷宫解谜师",
  RTFC: "集市寻路人",
  RASI: "磐石筑路者",
  RASC: "桥梁营造师",
  RAFI: "荒野开拓者",
  RAFC: "风帆行动家",
};
export const dimensions = [
  {
    name: "动力来源",
    pair: ["V", "R"],
    left: "从个人价值与生活方向理解投入",
    right: "从具体问题与可见改善理解投入",
    tips: [
      "先谈谈这件事与你在意的生活有什么联系。",
      "先看这件事能够带来哪一种具体改善。",
    ],
  },
  {
    name: "启动路径",
    pair: ["T", "A"],
    left: "先了解依据或原因",
    right: "借可控的小尝试了解问题",
    tips: [
      "可以先讲清关键依据，再商量下一步。",
      "可以先试一个可逆的小动作，再看反馈。",
    ],
  },
  {
    name: "推进节奏",
    pair: ["S", "F"],
    left: "喜欢预先顺序和熟悉流程",
    right: "喜欢保留调整安排的余地",
    tips: [
      "可以给出有限的步骤，不要求一口气做完。",
      "可以保留做法和时间的调整空间。",
    ],
  },
  {
    name: "支持方式",
    pair: ["I", "C"],
    left: "喜欢独自整理想法与经历",
    right: "喜欢通过可信交流整理想法与经历",
    tips: [
      "先留一些自己整理的空间，需要时再交流。",
      "可以邀请可信的人一起梳理，但不用每次都这样。",
    ],
  },
] as const;
export type Answer = { id: string; value: number | "unable" | "skipped" };
export type EndpointScore = {
  mean: number | null;
  valid: number;
  drawn: number;
};
export type DimensionResult = {
  name: string;
  pair: Endpoint[];
  status: string;
  code: string;
  description: string;
  suggestion: string;
};
export type Report = {
  version: string;
  nickname: string;
  createdAt: number;
  total: number;
  valid: number;
  code: string;
  role: string | null;
  scores: Record<Endpoint, EndpointScore>;
  dimensions: DimensionResult[];
  summary: string;
};
function shuffle<T>(array: T[], random: () => number) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function drawQuestions(
  count: number,
  random: () => number = () =>
    crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
): Question[] {
  if (!Number.isInteger(count) || count < 8 || count > 32)
    throw new Error("抽题数量须为8至32之间的整数");
  const base = Math.floor(count / 8),
    extras = new Set(shuffle([...endpoints], random).slice(0, count % 8));
  return shuffle(
    endpoints.flatMap((e) =>
      shuffle(
        questions.filter((q) => q.endpoint === e),
        random,
      ).slice(0, base + (extras.has(e) ? 1 : 0)),
    ),
    random,
  );
}
export function makeReport(
  nickname: string,
  selected: Question[],
  answers: Answer[],
  createdAt = Date.now(),
): Report {
  if (
    answers.length !== selected.length ||
    new Set(answers.map((a) => a.id)).size !== answers.length
  )
    throw new Error("请完成每道题，不能重复提交题号");
  const map = new Map(answers.map((a) => [a.id, a.value]));
  for (const q of selected) {
    const v = map.get(q.id);
    if (!(
      v === "unable" ||
      v === "skipped" ||
      (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 4)
    ))
      throw new Error("存在缺失或无效答案");
  }
  const scores = {} as Record<Endpoint, EndpointScore>;
  for (const e of endpoints) {
    const qs = selected.filter((q) => q.endpoint === e);
    const values = qs
      .map((q) => map.get(q.id))
      .filter((v): v is number => typeof v === "number");
    scores[e] = {
      mean:
        values.length >= 3
          ? values.reduce((s, v) => s + v, 0) / values.length
          : null,
      valid: values.length,
      drawn: qs.length,
    };
  }
  const results: DimensionResult[] = dimensions.map((d) => {
    const [l, r] = d.pair;
    const a = scores[l].mean,
      b = scores[r].mean;
    let status = "暂无明显侧重",
      code = "?",
      description = "本次回答在这两种偏好之间，没有形成明显的相对侧重。",
      suggestion = "可以在具体事情上，商量这次更喜欢哪种方式。";
    if (a === null || b === null) {
      status = "信息不足";
      description = "至少一端有效答案少于3题，暂不判断侧重。";
      suggestion = "如果你愿意，可以重做完整32题；也可以直接说出这次的需要。";
    } else if (a >= 3 && b >= 3) {
      status = "两端并重";
      description = `你对「${endpointNames[l]}」和「${endpointNames[r]}」的描述都较认同，两种方式可以共存。`;
    } else if (a <= 1 && b <= 1) {
      status = "较少符合";
      description = "这组描述目前较少符合你的体验，不代表能力或成长动力不足。";
      suggestion = "可以用自己的话补充更贴近你的做法。";
    } else if (a - b >= 1) {
      status = `相对侧重${endpointNames[l]}`;
      code = l;
      description = `本次回答相对更偏向：${d.left}。另一种偏好仍可能适合你。`;
      suggestion = d.tips[0];
    } else if (b - a >= 1) {
      status = `相对侧重${endpointNames[r]}`;
      code = r;
      description = `本次回答相对更偏向：${d.right}。另一种偏好仍可能适合你。`;
      suggestion = d.tips[1];
    }
    return {
      name: d.name,
      pair: [l, r],
      status,
      code,
      description,
      suggestion,
    };
  });
  const code = results.map((r) => r.code).join("");
  const role = roles[code] || null;
  return {
    version: VERSION,
    nickname,
    createdAt,
    total: selected.length,
    valid: answers.filter((a) => typeof a.value === "number").length,
    code,
    role,
    scores,
    dimensions: results,
    summary: role
      ? `你的本次答案呈现出「${role}」的相对偏好组合。这个故事名字帮助表达偏好，不代表能力、命运或固定人格。`
      : "你的成长偏好呈现出并重、接近或暂未确定的部分。我们保留这些差异，不强行把你放进一个角色。",
  };
}
