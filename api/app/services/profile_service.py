from typing import Optional

from app.core.config import ABOUT_ME_LIMITS
from app.core.exceptions import bad_request, not_found
from app.repositories.label_repository import label_repo
from app.repositories.profile_repository import profile_repo
from app.repositories.user_repository import user_repo
from app.schemas.profiles import (
    PrivacyOut, PublicProfile, SocialLink, SubscriptionOut, UpdatePrivacyRequest,
    UpdateProfileRequest,
)


def _check_about_me_limit(role: str, about_me: str) -> None:
    limit = ABOUT_ME_LIMITS.get(role)
    if limit is not None and len(about_me.split()) > limit:
        raise bad_request(f"About-me is limited to {limit} words for your account tier")


class ProfileService:
    def get_public_profile(self, username: str) -> PublicProfile:
        user = user_repo.find_by_username(username)
        if not user:
            raise not_found("User not found")

        privacy = profile_repo.get_privacy(user["id"])
        socials = profile_repo.list_socials(user["id"]) if privacy["show_socials"] else []
        labels = label_repo.list_for_user(user["id"])

        return PublicProfile(
            id=user["id"],
            username=user["username"],
            about_me=user.get("about_me"),
            avatar_url=user.get("avatar_url"),
            is_verified_tick=bool(user["is_verified_tick"]),
            labels=labels,
            socials=[SocialLink(platform=s["platform"], value=s["value"]) for s in socials],
            follower_count=profile_repo.follower_count(user["id"]),
            following_count=profile_repo.following_count(user["id"]),
            post_count=profile_repo.post_count(user["id"]),
            created_at=user["created_at"],
        )

    def update_profile(self, user_id: str, role: str, body: UpdateProfileRequest) -> None:
        if body.about_me is not None:
            _check_about_me_limit(role, body.about_me)
        user_repo.update_profile(user_id, body.about_me, body.avatar_url)
        if body.socials is not None:
            profile_repo.replace_socials(user_id, [s.model_dump() for s in body.socials])

    def get_privacy(self, user_id: str) -> PrivacyOut:
        return PrivacyOut(**profile_repo.get_privacy(user_id))

    def update_privacy(self, user_id: str, body: UpdatePrivacyRequest) -> PrivacyOut:
        fields = {k: v for k, v in body.model_dump().items() if v is not None}
        return PrivacyOut(**profile_repo.update_privacy(user_id, fields))

    def get_subscription(self, user_id: str) -> SubscriptionOut:
        sub = profile_repo.get_subscription(user_id)
        if not sub:
            return SubscriptionOut(tier="free", status="active", expires_at=None)
        return SubscriptionOut(tier=sub["tier"], status=sub["status"], expires_at=sub.get("expires_at"))


profile_service = ProfileService()
