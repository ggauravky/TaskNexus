# Notification Event Matrix

This audit records the notification producers that existed before the Phase B UI was wired. The resolver owns navigation; producer-supplied `content.actionUrl` is treated as untrusted input and is used only when it matches the notification family and the internal route allow-list.

| Event / creation call site | Recipient | Type | Trusted reference | Canonical target | Phase B UI support |
| --- | --- | --- | --- | --- | --- |
| Marketplace assignment (`freelancerController`, `notificationService`) | assigned freelancer or task client | `task_assigned` | `related_task_id` | `/tasks/:id` | API + focused SSE when created through `NotificationService` |
| Marketplace work started (`freelancerController`) | task client | `task_started` | `related_task_id` | `/tasks/:id` | API + focused SSE |
| Marketplace task returned (`freelancerController`) | task client | `task_unaccepted` | `related_task_id` | `/tasks/:id` | API + focused SSE |
| Marketplace progress changed (`freelancerController`) | task client | `task_progress` | `related_task_id` | `/tasks/:id?tab=work` | API + focused SSE |
| Marketplace submission/resubmission (`taskController`, `freelancerController`, `notificationService`) | task client or assigned freelancer | `task_submitted`, `submission_updated` | `related_task_id` | `/tasks/:id?tab=delivery` | API + focused SSE |
| Marketplace approval/revision (`clientController`, `notificationService`) | assigned freelancer or task client | `submission_approved`, `client_approval`, `qa_feedback`, `revision_requested` | `related_task_id` | `/tasks/:id?tab=delivery` | API + focused SSE |
| Marketplace deadline/payment/review (`notificationService`, `clientController`) | assigned freelancer | `deadline_reminder`, `payment_released`, `new_review` | `related_task_id` | task overview when task-backed; otherwise `/notifications` | API + focused SSE |
| Marketplace admin moderation (`adminController`) | task client | `task_approved`, `task_rejected` | `related_task_id` | `/tasks/:id` | API + focused SSE |
| Account moderation (`adminController`) | affected account | `account_status_changed` | none | `/notifications` | API + focused SSE |
| Task comment mention (`collaborationService`) | mentioned task participant | `task_submitted` plus `content.commentId` | `related_task_id` | `/tasks/:id?tab=discussion` | API + focused SSE |
| Team invitation (`invitationService`) | invited user | `team_invitation` | `entity_type=team`, `entity_id` | validated team route or `/teams` | API refresh; transaction producer does not publish SSE |
| Team invitation accepted (`invitationService`) | inviter | `team_invitation_accepted` | team entity | validated `/teams/:slug` or `/teams` | API refresh |
| Team join request/result (`joinRequestService`) | managers or requester | `team_join_request`, `team_join_request_accepted`, `team_join_request_rejected` | team entity | validated team route or `/teams` | API refresh |
| Team membership changes (`membershipService`) | affected member | `team_member_removed`, `team_role_changed`, `team_ownership_transferred` | team entity | validated team route or `/teams` | API refresh |
| Collaboration request/result (`collaborationRequestService`) | recipient or sender | `collaboration_request_received`, `collaboration_request_accepted`, `collaboration_request_declined` | collaboration request entity | `/collaboration` | API refresh |
| Team opening interest (`collaborationRequestService`) | team managers | `team_opening_interest` | team opening entity | validated team settings route or `/teams` | API refresh |
| Project participant changes (`projectParticipantService`) | affected participant | `project_added`, `project_removed`, `project_role_changed` | project entity | validated project/team route or `/projects` | API refresh |
| Project task events (`projectTaskService`) | assignees/participants | `project_task_assigned`, `project_task_completed` | project entity | validated project route or `/projects` | API refresh |
| Project milestone/showcase (`projectMilestoneService`, `showcaseService`) | project participants | `project_milestone_completed`, `project_showcase_published` | project entity | validated project/showcase route or `/projects` | API refresh |
| Hackathon team registration (`hackathonService`) | registering user | `hackathon_team_registered` | hackathon team entity | `/hackathons` | API refresh; producer currently has no hackathon slug in the notification |
| Hackathon submission (`hackathonService`) | team members | `hackathon_submission_submitted` | hackathon submission entity | `/hackathons` | API refresh; producer currently has no hackathon slug in the notification |
| Organization invitation (`organizationService`) | invited user | `organization_invitation` | organization entity | `/organization-invitations` | API refresh |
| Organization invitation accepted/role/ownership (`organizationService`) | inviter or affected member | `organization_invitation_accepted`, `organization_role_changed`, `organization_ownership_transferred` | organization entity | validated organization workspace route, otherwise `/notifications` | API refresh |
| Native application submitted (`nativeApplicationService`) | candidate | `native_application_submitted` | native application entity | `/applications` | API refresh |
| Native application received (`nativeApplicationService`) | organization recruiters | `native_application_received` | native application entity | validated organization applicants route, otherwise `/notifications` | API refresh |
| Application stage/withdrawal (`nativeApplicationService`) | candidate or recruiters | `application_stage_changed`, `application_withdrawn` | native application entity | `/applications` or validated organization applicants route | API refresh |

## Intentional boundaries

- No new notification event vocabulary or persistence model is introduced.
- Transactional domain producers that write `Notification` directly remain API-refresh correct. Converting every producer to post-commit SSE is outside Phase B and is not required for correctness.
- Existing persisted preference fields are not added to the new UI because current creation paths do not consistently honor them. Phase B does not promise an ineffective preference or add a rules engine.
- Types without sufficient trusted route context fall back to `/notifications`; the resolver never guesses a slug from display content.

