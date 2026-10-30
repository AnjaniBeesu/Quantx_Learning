import { definePrismaConfig } from "prisma/config";

export default definePrismaConfig({
  schema: "prisma/scheme.prisma",
  skills: {
    agents: ["claude", "cursor", "agents", "devin"],
  },
});
