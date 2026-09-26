import { createFileRoute, redirect } from "@tanstack/react-router";

/** Threads now live at /thread/{id}; old /post/{id} links land here. */
export const Route = createFileRoute("/post/$postId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/thread/$threadId",
      params: { threadId: params.postId },
      replace: true,
    });
  },
});
