import { DiscussionModule } from '@/modules/discussion'

interface DiscussionPageProps {
  params: { sessionId: string }
}

export default function DiscussionPage({ params }: DiscussionPageProps) {
  return <DiscussionModule sessionId={params.sessionId} />
}
