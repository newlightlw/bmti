import { dimensions, endpointNames, type Report } from "./hgp";

// Presentation only: preserve the recorded answers, scores and role decision.
// Derive from scores so previously saved HGP-0.2 reports benefit on reload too.
export function presentPortrait(report: Report) {
  const results = dimensions.map((d, index) => {
    const [left, right] = d.pair;
    const a = report.scores[left].mean;
    const b = report.scores[right].mean;
    const original = report.dimensions[index];
    const base = { ...original, name: d.name, pair: [left, right] };
    if (a === null || b === null) {
      const known = a === null ? (b === null ? null : right) : left;
      return {
        ...base,
        status: "信息不足",
        description: known
          ? `「${endpointNames[known]}」已有可用均分，另一端不足3道有效答案；当前不能比较两端。`
          : "两端均不足3道有效答案，目前无法描述这一组的相对偏好。",
        brief: `${d.name}信息不足`,
      };
    }
    if (a >= 3 && b >= 3) {
      return {
        ...base,
        status: "两端都认同",
        description: `你对「${endpointNames[left]}」和「${endpointNames[right]}」都较认同：${d.left}，也${d.right}。两种偏好可以共存；具体如何搭配，还需要你自己确认。`,
        brief: `${endpointNames[left]}与${endpointNames[right]}都认同`,
      };
    }
    if (a <= 1 && b <= 1) {
      return {
        ...base,
        status: "两端较少符合",
        description: `「${endpointNames[left]}」和「${endpointNames[right]}」目前都较少符合你的回答。可以补充更贴近自己的做法；这不表示能力或成长动力不足。`,
        brief: `${d.name}的两端均较少符合`,
      };
    }
    if (a === b) {
      return {
        ...base,
        status: "两端得分相同",
        description: `你对「${endpointNames[left]}」和「${endpointNames[right]}」的认同程度相同；仅凭均分无法选出更偏好的方式。`,
        brief: `${endpointNames[left]}与${endpointNames[right]}得分相同`,
      };
    }
    const higher = a > b ? left : right;
    const difference = Math.abs(a - b);
    const preference = a > b ? d.left : d.right;
    const slight = difference < 1;
    return {
      ...base,
      status: slight
        ? `${endpointNames[higher]}分数略高`
        : `相对侧重${endpointNames[higher]}`,
      description: `本次「${endpointNames[higher]}」均分高出${difference.toFixed(2)}分，${slight ? "略偏向" : "相对更偏向"}：${preference}。${slight ? "差异未达到角色分类的1分门槛，仍保留另一种可能；这不妨碍描述你的偏好。" : "另一种方式仍可能适合你。"}`,
      brief: `${endpointNames[higher]}${slight ? "略高" : "相对侧重"}`,
    };
  });
  return {
    title: report.role || "你的个人偏好画像",
    badge: report.role ? report.code : "四维偏好画像",
    label: report.role ? "偏好组合" : "个人画像独立于角色分类",
    summary: `本次回答呈现：${results.map((d) => d.brief).join("；")}。这是本次自述的偏好描述，不代表能力或固定性格。`,
    roleNote: report.role
      ? "角色名称是偏好组合的故事摘要，请核对它是否贴近自己。"
      : "16种角色需四组都形成明确侧重才会显示；并重、接近或信息不足时，不强配角色。没有角色名称不等于没有个人画像。",
    dimensions: results,
  };
}
