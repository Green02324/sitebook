// User-facing name for the bucket of costs that aren't billable to any one
// job — insurance, vehicle, fuel, tools. The API routes, database tables, and
// response fields all still say "overhead"; only the display name changed, so
// this is the single place to adjust it again later.
export const OVERHEAD_LABEL = "Operating Expenses";

// Long form for the section heading, where the old name is worth keeping
// visible while the new one settles in.
export const OVERHEAD_LABEL_FULL = "Operating Expenses (Overhead)";
