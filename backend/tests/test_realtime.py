from app.services.realtime import ConnectionManager


class FakeWebSocket:
    def __init__(self):
        self.events = []

    async def accept(self):
        pass

    async def send_json(self, event):
        self.events.append(event)

    async def close(self):
        pass


async def test_presence_tracks_multiple_tabs_and_emits_only_first_and_last_transition():
    manager = ConnectionManager()
    observer = FakeWebSocket()
    first_tab = FakeWebSocket()
    second_tab = FakeWebSocket()

    await manager.connect(observer)
    await manager.connect(first_tab, "user-1")
    await manager.connect(second_tab, "user-1")
    assert manager.online_user_ids == {"user-1"}
    assert [event for event in first_tab.events if event["type"] == "presence.changed"] == [
        {"type": "presence.changed", "userId": "user-1", "online": True}
    ]
    assert not [event for event in second_tab.events if event["type"] == "presence.changed"]

    await manager.disconnect(first_tab)
    assert manager.online_user_ids == {"user-1"}
    await manager.disconnect(second_tab)
    assert manager.online_user_ids == set()
    assert observer.events[-1] == {
        "type": "presence.changed",
        "userId": "user-1",
        "online": False,
    }
    await manager.disconnect(observer)


async def test_private_events_are_sent_only_to_target_user():
    manager = ConnectionManager()
    first_user = FakeWebSocket()
    other_user = FakeWebSocket()
    await manager.connect(first_user, "user-1")
    await manager.connect(other_user, "user-2")

    await manager.send_to_user("user-1", {"type": "notification.created", "unreadCount": 1})

    assert first_user.events[-1] == {"type": "notification.created", "unreadCount": 1}
    assert not any(event["type"] == "notification.created" for event in other_user.events)

    await manager.disconnect(first_user)
    await manager.disconnect(other_user)
