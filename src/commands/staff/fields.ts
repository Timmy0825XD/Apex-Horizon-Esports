export const roleFields = [
  { key: "managerRoleId", option: "manager_role", label: "Manager Role" },
  { key: "t1AdminRoleId", option: "t1_admin_role", label: "T1 Admin Role" },
  { key: "t2AdminRoleId", option: "t2_admin_role", label: "T2 Admin Role" },
  { key: "challongeModRoleId", option: "challonge_mod", label: "Challonge Mod" },
  { key: "serverHelperRoleId", option: "server_helper_role", label: "Server Helper Role" },
  { key: "bestStaffRoleId", option: "best_staff_role", label: "Best Staff Role" },
  { key: "judgeRoleId", option: "judge_role", label: "Judge Role" },
  { key: "recorderRoleId", option: "recorder_role", label: "Recorder Role" },
  { key: "staffRoleId", option: "staff_role", label: "Staff Role" },
] as const;

export const channelFields = [
  { key: "staffchatChannelId", option: "staffchat_channel", label: "Staff Chat" },
  { key: "staffAnnouncementChannelId", option: "staff_announcement_channel", label: "Staff Announcements" },
  { key: "staffRulesChannelId", option: "staff_rules_channel", label: "Staff Rules" },
  { key: "staffDetailsChannelId", option: "staff_details_channel", label: "Staff Details" },
] as const;

export const staffFields = [...roleFields, ...channelFields] as const;

export type StaffFieldKey = (typeof staffFields)[number]["key"];

export type StaffInput = {
  managerRoleId: string;
  t1AdminRoleId: string | null;
  t2AdminRoleId: string | null;
  challongeModRoleId: string;
  serverHelperRoleId: string;
  bestStaffRoleId: string;
  judgeRoleId: string;
  recorderRoleId: string;
  staffRoleId: string;
  staffchatChannelId: string;
  staffAnnouncementChannelId: string;
  staffRulesChannelId: string;
  staffDetailsChannelId: string;
};
