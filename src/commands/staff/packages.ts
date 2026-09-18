import type { StaffInput } from "./fields.js";

export const recruitChoices = [
  { name: "Judge", value: "judge" },
  { name: "Recorder", value: "recorder" },
  { name: "T1 Admin", value: "t1_admin" },
  { name: "T2 Admin", value: "t2_admin" },
  { name: "Best Staff", value: "best_staff" },
  { name: "Server Helper", value: "server_helper" },
  { name: "Judge + Recorder", value: "judge_recorder" },
  { name: "T1 Admin + Helper + Best Staff", value: "t1_admin_helper_best" },
  { name: "T2 Admin + Helper + Best Staff", value: "t2_admin_helper_best" },
] as const;

export const fireChoices = [
  { name: "Judge", value: "judge" },
  { name: "Recorder", value: "recorder" },
  { name: "T1 Admin", value: "t1_admin" },
  { name: "T2 Admin", value: "t2_admin" },
  { name: "Best Staff", value: "best_staff" },
  { name: "Server Helper", value: "server_helper" },
  { name: "T1 Admin + Helper + Best Staff", value: "t1_admin_helper_best" },
  { name: "T2 Admin + Helper + Best Staff", value: "t2_admin_helper_best" },
  { name: "Complete (remove all staff roles)", value: "complete" },
] as const;

export type RecruitPost = (typeof recruitChoices)[number]["value"];
export type FirePost = (typeof fireChoices)[number]["value"];

type RoleKey = keyof Pick<
  StaffInput,
  | "staffRoleId"
  | "judgeRoleId"
  | "recorderRoleId"
  | "t1AdminRoleId"
  | "t2AdminRoleId"
  | "bestStaffRoleId"
  | "serverHelperRoleId"
  | "managerRoleId"
  | "challongeModRoleId"
>;

const recruitPackages: Record<RecruitPost, RoleKey[]> = {
  judge: ["judgeRoleId", "staffRoleId"],
  recorder: ["recorderRoleId", "staffRoleId"],
  t1_admin: ["t1AdminRoleId", "serverHelperRoleId", "staffRoleId"],
  t2_admin: ["t2AdminRoleId", "serverHelperRoleId", "staffRoleId"],
  best_staff: ["bestStaffRoleId"],
  server_helper: ["serverHelperRoleId", "staffRoleId"],
  judge_recorder: ["judgeRoleId", "recorderRoleId", "staffRoleId"],
  t1_admin_helper_best: ["t1AdminRoleId", "serverHelperRoleId", "bestStaffRoleId", "staffRoleId"],
  t2_admin_helper_best: ["t2AdminRoleId", "serverHelperRoleId", "bestStaffRoleId", "staffRoleId"],
};

const firePackages: Record<Exclude<FirePost, "complete">, RoleKey[]> = {
  judge: ["judgeRoleId"],
  recorder: ["recorderRoleId"],
  t1_admin: ["t1AdminRoleId"],
  t2_admin: ["t2AdminRoleId"],
  best_staff: ["bestStaffRoleId"],
  server_helper: ["serverHelperRoleId"],
  t1_admin_helper_best: ["t1AdminRoleId", "serverHelperRoleId", "bestStaffRoleId"],
  t2_admin_helper_best: ["t2AdminRoleId", "serverHelperRoleId", "bestStaffRoleId"],
};

const allStaffRoleKeys: RoleKey[] = [
  "staffRoleId",
  "judgeRoleId",
  "recorderRoleId",
  "t1AdminRoleId",
  "t2AdminRoleId",
  "bestStaffRoleId",
  "serverHelperRoleId",
  "managerRoleId",
  "challongeModRoleId",
];

export function recruitLabel(post: RecruitPost): string {
  return recruitChoices.find((choice) => choice.value === post)?.name ?? post;
}

export function fireLabel(post: FirePost): string {
  return fireChoices.find((choice) => choice.value === post)?.name ?? post;
}

export function isRecruitPost(value: string): value is RecruitPost {
  return recruitChoices.some((choice) => choice.value === value);
}

export function isFirePost(value: string): value is FirePost {
  return fireChoices.some((choice) => choice.value === value);
}

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

export function roleIdsForRecruit(staff: StaffInput, post: RecruitPost): { missing: RoleKey[]; roleIds: string[] } {
  const missing: RoleKey[] = [];
  const ids: string[] = [];
  for (const key of recruitPackages[post]) {
    const id = staff[key];
    if (!id) {
      missing.push(key);
      continue;
    }
    ids.push(id);
  }
  return { missing, roleIds: uniqueIds(ids) };
}

export function roleIdsForFire(staff: StaffInput, post: FirePost): { missing: RoleKey[]; roleIds: string[] } {
  if (post === "complete") {
    return { missing: [], roleIds: uniqueIds(allStaffRoleKeys.map((key) => staff[key])) };
  }

  const missing: RoleKey[] = [];
  const ids: string[] = [];
  for (const key of firePackages[post]) {
    const id = staff[key];
    if (!id) {
      missing.push(key);
      continue;
    }
    ids.push(id);
  }
  return { missing, roleIds: uniqueIds(ids) };
}
