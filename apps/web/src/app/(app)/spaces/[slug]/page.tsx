import { redirect } from 'next/navigation'
export default function SpaceRoomRedirect({ params }: { params: { slug: string } }) {
  redirect(`/halka/${params.slug}`)
}
