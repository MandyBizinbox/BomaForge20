from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from database import db
from middleware import get_current_user

router = APIRouter(prefix="/api/streaks", tags=["streaks"])

@router.get("")
async def get_family_streaks(request: Request):
    current = await get_current_user(request)
    family_id = current.get("family_id")
    if not family_id:
        return {"streaks": []}
    children = await db.children.find({"family_id": family_id}, {"_id": 0}).to_list(100)
    streaks = []
    today = datetime.now(timezone.utc).date()
    for child in children:
        # Calculate lesson streak (consecutive days with all lessons done)
        lesson_streak = 0
        check_date = today
        for _ in range(365):
            date_str = check_date.strftime("%Y-%m-%d")
            day_lessons = await db.lessons.find(
                {"child_id": child["id"], "planned_date": date_str}, {"_id": 0}
            ).to_list(100)
            if not day_lessons:
                check_date -= timedelta(days=1)
                continue
            all_done = all(l["status"] == "done" for l in day_lessons)
            if all_done:
                lesson_streak += 1
                check_date -= timedelta(days=1)
            else:
                break
        # Calculate chore streak
        chore_streak = 0
        check_date = today
        for _ in range(365):
            date_str = check_date.strftime("%Y-%m-%d")
            day_chores = await db.chore_instances.find(
                {"child_id": child["id"], "planned_date": date_str}, {"_id": 0}
            ).to_list(100)
            if not day_chores:
                check_date -= timedelta(days=1)
                continue
            all_done = all(c["status"] in ["done", "approved"] for c in day_chores)
            if all_done:
                chore_streak += 1
                check_date -= timedelta(days=1)
            else:
                break
        # Weekly stats
        week_start = today - timedelta(days=today.weekday())
        week_start_str = week_start.strftime("%Y-%m-%d")
        week_end_str = (week_start + timedelta(days=6)).strftime("%Y-%m-%d")
        week_lessons = await db.lessons.find({
            "child_id": child["id"],
            "planned_date": {"$gte": week_start_str, "$lte": week_end_str}
        }, {"_id": 0}).to_list(500)
        week_chores = await db.chore_instances.find({
            "child_id": child["id"],
            "planned_date": {"$gte": week_start_str, "$lte": week_end_str}
        }, {"_id": 0}).to_list(500)
        week_lessons_done = len([l for l in week_lessons if l["status"] == "done"])
        week_chores_done = len([c for c in week_chores if c["status"] in ["done", "approved"]])
        total_week = len(week_lessons) + len(week_chores)
        done_week = week_lessons_done + week_chores_done
        # Badges
        badges = []
        if lesson_streak >= 7:
            badges.append({"name": "Week Warrior", "icon": "shield", "color": "#F4C542"})
        if lesson_streak >= 30:
            badges.append({"name": "Monthly Master", "icon": "crown", "color": "#C06C47"})
        if chore_streak >= 5:
            badges.append({"name": "Tidy Star", "icon": "sparkles", "color": "#88C477"})
        if done_week == total_week and total_week > 0:
            badges.append({"name": "Perfect Week", "icon": "trophy", "color": "#4F9DCE"})
        streaks.append({
            "child_id": child["id"],
            "child_name": child["name"],
            "avatar_color": child.get("avatar_color", "#4F9DCE"),
            "lesson_streak": lesson_streak,
            "chore_streak": chore_streak,
            "week_lessons_done": week_lessons_done,
            "week_lessons_total": len(week_lessons),
            "week_chores_done": week_chores_done,
            "week_chores_total": len(week_chores),
            "week_total_done": done_week,
            "week_total": total_week,
            "badges": badges,
        })
    # Sort by total streaks
    streaks.sort(key=lambda s: s["lesson_streak"] + s["chore_streak"], reverse=True)
    return {"streaks": streaks}
