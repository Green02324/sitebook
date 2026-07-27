import { Stack } from "expo-router";

// Nested stack so the bottom tab bar persists while drilling into a project
// (matches how the projects tab is meant to behave: list -> detail -> report).
export default function ProjectsStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Projects" }} />
      <Stack.Screen name="[projectId]/index" options={{ title: "Project" }} />
      <Stack.Screen name="[projectId]/report" options={{ title: "Report" }} />
    </Stack>
  );
}
