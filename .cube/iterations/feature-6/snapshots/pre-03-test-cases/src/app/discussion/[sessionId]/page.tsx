import { DiscussionModule } from '@/modules/discussion'

interface DiscussionPageProps {
  params: Promise<{ sessionId: string }>
}

export default async function DiscussionPage({ params }: DiscussionPageProps) {
  const { sessionId } = await params
  return <DiscussionModule sessionId={sessionId} />
}
