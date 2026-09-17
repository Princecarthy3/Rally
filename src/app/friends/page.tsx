import { ProtectedPage } from "@/components/protected-page";
import { SocialPage } from "@/features/social/social-page";

export default function FriendsPage() { return <ProtectedPage><SocialPage /></ProtectedPage>; }
