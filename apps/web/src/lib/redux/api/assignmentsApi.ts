import { baseApi } from "./baseApi";

export const assignmentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRoomAssignments: builder.query<any[], { roomId: string; status?: string }>({
      query: ({ roomId, status }) => ({
        url: `/assignments/room/${roomId}`,
        params: status ? { status } : {},
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id }) => ({ type: "Assignments" as const, id: _id })),
              { type: "Assignments", id: "LIST" },
            ]
          : [{ type: "Assignments", id: "LIST" }],
    }),
    getAssignmentDetail: builder.query<any, string>({
      query: (id) => ({ url: `/assignments/${id}` }),
      providesTags: (result, error, id) => [{ type: "Assignments", id }],
    }),
    createAssignment: builder.mutation<any, any>({
      query: (body) => ({
        url: "/assignments",
        method: "POST",
        data: body,
      }),
      invalidatesTags: [{ type: "Assignments", id: "LIST" }],
    }),
    updateAssignment: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/assignments/${id}`,
        method: "PUT",
        data: body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Assignments", id: "LIST" },
        { type: "Assignments", id },
      ],
    }),
    deleteAssignment: builder.mutation<any, string>({
      query: (id) => ({
        url: `/assignments/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Assignments", id: "LIST" }],
    }),
    submitAssignment: builder.mutation<any, { id: string; body: any }>({
      query: ({ id, body }) => ({
        url: `/assignments/${id}/submit`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Submissions", id: "LIST" },
        { type: "Submissions", id: `MY_${id}` },
        { type: "Assignments", id },
      ],
    }),
    getSubmissions: builder.query<any[], string>({
      query: (assignmentId) => ({ url: `/assignments/${assignmentId}/submissions` }),
      providesTags: [{ type: "Submissions", id: "LIST" }],
    }),
    getMySubmission: builder.query<any, string>({
      query: (assignmentId) => ({ url: `/assignments/${assignmentId}/my-submission` }),
      providesTags: (result, error, assignmentId) => [
        { type: "Submissions", id: `MY_${assignmentId}` },
      ],
    }),
    gradeSubmission: builder.mutation<
      any,
      { submissionId?: string; studentId?: string; body: any; assignmentId: string }
    >({
      query: ({ submissionId, studentId, body, assignmentId }) => ({
        url: submissionId
          ? `/assignments/submissions/${submissionId}/grade`
          : `/assignments/${assignmentId}/students/${studentId}/grade`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (result, error, { assignmentId }) => [
        { type: "Submissions", id: "LIST" },
        { type: "Submissions", id: `MY_${assignmentId}` },
        { type: "Assignments", id: "LIST" },
        { type: "Assignments", id: assignmentId },
      ],
    }),
    deleteSubmission: builder.mutation<any, string>({
      query: (assignmentId) => ({
        url: `/assignments/${assignmentId}/submit`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, assignmentId) => [
        { type: "Submissions", id: "LIST" },
        { type: "Submissions", id: `MY_${assignmentId}` },
        { type: "Assignments", id: "LIST" },
        { type: "Assignments", id: assignmentId },
      ],
    }),
    addSubmissionComment: builder.mutation<any, { submissionId: string; content: string; assignmentId: string }>({
      query: ({ submissionId, content }) => ({
        url: `/assignments/submissions/${submissionId}/comments`,
        method: "POST",
        data: { content },
      }),
      invalidatesTags: (result, error, { assignmentId }) => [
        { type: "Submissions", id: `MY_${assignmentId}` },
      ],
    }),
    getAssignmentComments: builder.query<any[], string | { assignmentId: string; memberId?: string }>({
      query: (arg) => {
        const assignmentId = typeof arg === "string" ? arg : arg.assignmentId;
        const memberId = typeof arg === "string" ? undefined : arg.memberId;
        return {
          url: `/assignments/${assignmentId}/comments`,
          params: memberId ? { memberId } : undefined,
        };
      },
      providesTags: (result, error, arg) => {
        const assignmentId = typeof arg === "string" ? arg : arg.assignmentId;
        return [{ type: "Assignments", id: `COMMENTS_${assignmentId}` }];
      },
    }),
    addAssignmentComment: builder.mutation<any, { assignmentId: string; content: string; memberId?: string }>({
      query: ({ assignmentId, content, memberId }) => ({
        url: `/assignments/${assignmentId}/comments`,
        method: "POST",
        data: { content, memberId },
      }),
      invalidatesTags: (result, error, { assignmentId }) => [
        { type: "Assignments", id: `COMMENTS_${assignmentId}` },
      ],
    }),
    deleteAssignmentComment: builder.mutation<any, { assignmentId: string; commentId: string }>({
      query: ({ assignmentId, commentId }) => ({
        url: `/assignments/${assignmentId}/comments/${commentId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { assignmentId }) => [
        { type: "Assignments", id: `COMMENTS_${assignmentId}` },
      ],
    }),

    // ─── Quiz endpoints ────────────────────────────────────────────────────
    startQuiz: builder.mutation<any, string>({
      query: (id) => ({
        url: `/assignments/${id}/quiz/start`,
        method: "POST",
      }),
    }),
    getMyQuizAttempt: builder.query<any, string>({
      query: (id) => ({ url: `/assignments/${id}/quiz/my-attempt` }),
      providesTags: (result, error, id) => [{ type: "Submissions", id: `QUIZ_${id}` }],
    }),
    submitQuiz: builder.mutation<any, { id: string; answers: unknown[] }>({
      query: ({ id, answers }) => ({
        url: `/assignments/${id}/quiz/submit`,
        method: "POST",
        data: { answers },
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Submissions", id: `QUIZ_${id}` },
        { type: "Submissions", id: "LIST" },
        { type: "Assignments", id: "LIST" },
      ],
    }),
    gradeEssayQuestion: builder.mutation<
      any,
      { assignmentId: string; studentId: string; essayScores: { questionId: string; score: number }[] }
    >({
      query: ({ assignmentId, studentId, essayScores }) => ({
        url: `/assignments/${assignmentId}/quiz/grade-essay`,
        method: "POST",
        data: { studentId, essayScores },
      }),
      invalidatesTags: (result, error, { assignmentId }) => [
        { type: "Submissions", id: "LIST" },
        { type: "Submissions", id: `QUIZ_${assignmentId}` },
      ],
    }),
    getQuizResults: builder.query<any, string>({
      query: (id) => ({ url: `/assignments/${id}/quiz/results` }),
      providesTags: (result, error, id) => [{ type: "Submissions", id: `QUIZ_RESULTS_${id}` }],
    }),
  }),
});

export const {
  useGetRoomAssignmentsQuery,
  useGetAssignmentDetailQuery,
  useCreateAssignmentMutation,
  useUpdateAssignmentMutation,
  useDeleteAssignmentMutation,
  useSubmitAssignmentMutation,
  useGetSubmissionsQuery,
  useGetMySubmissionQuery,
  useGradeSubmissionMutation,
  useDeleteSubmissionMutation,
  useAddSubmissionCommentMutation,
  useGetAssignmentCommentsQuery,
  useAddAssignmentCommentMutation,
  useDeleteAssignmentCommentMutation,
  useStartQuizMutation,
  useGetMyQuizAttemptQuery,
  useSubmitQuizMutation,
  useGradeEssayQuestionMutation,
  useGetQuizResultsQuery,
} = assignmentsApi;