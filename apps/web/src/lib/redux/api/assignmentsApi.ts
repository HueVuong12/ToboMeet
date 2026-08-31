import { baseApi } from "./baseApi";

export const assignmentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRoomAssignments: builder.query<any[], string>({
      query: (roomId) => `/assignments/room/${roomId}`,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id }) => ({ type: "Assignments" as const, id: _id })),
              { type: "Assignments", id: "LIST" },
            ]
          : [{ type: "Assignments", id: "LIST" }],
    }),
    getAssignmentDetail: builder.query<any, string>({
      query: (id) => `/assignments/${id}`,
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
        { type: "Assignments", id },
      ],
    }),
    getSubmissions: builder.query<any[], string>({
      query: (assignmentId) => `/assignments/${assignmentId}/submissions`,
      providesTags: [{ type: "Submissions", id: "LIST" }],
    }),
    getMySubmission: builder.query<any, string>({
      query: (assignmentId) => `/assignments/${assignmentId}/my-submission`,
      providesTags: (result, error, assignmentId) => [
        { type: "Submissions", id: `MY_${assignmentId}` },
      ],
    }),
    gradeSubmission: builder.mutation<any, { submissionId: string; body: any; assignmentId: string }>({
      query: ({ submissionId, body }) => ({
        url: `/assignments/submissions/${submissionId}/grade`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (result, error, { assignmentId }) => [
        { type: "Submissions", id: "LIST" },
        { type: "Submissions", id: `MY_${assignmentId}` },
      ],
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
} = assignmentsApi;