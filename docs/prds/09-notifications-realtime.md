> Template générique bibliothèque Propul'SEO — à adapter à Ocean (voir docs/PRD.md).

# PRD - NOTIFICATIONS REALTIME (in-app + email + push) pour [PROJET] E-COMMERCE/ERP

## 1. VIBE & GOAL
**Vibe** : Notifs type Linear/Notion. Bell icon avec count, dropdown propre, archivage, préférences fines, multi-canal sans spam.

**Goal** : Système unifié notifications pour `[PROJET]` : in-app (realtime), email (Brevo), push browser (PWA), mobile push (Expo), Telegram/Slack admin. Préférences user, anti-spam, batch hebdo.

## 2. USER STORIES
- As user, I want voir bell badge avec nouveautés so que je sais sans rafraîchir.
- As user, I want choisir canaux par type so que pas spammé.
- As user, I want marquer lu/tout lu so que je nettoie.
- As admin, I want envoyer broadcast à segment so que je communique masse.
- As user, I want digest hebdo email so que je résume.
- As mobile, I want push notif paiement reçu so que je sais instantanément.

## 3. TECH SPECS

### Composants shadcn/ui
- `Popover` notifications dropdown
- `Tabs` (Toutes | Non lues | Archivées)
- `ScrollArea` liste virtualized
- `Badge` count unread
- `Switch` préférences canal/type
- `Card` notif détaillée mobile
- `Bell` icon (lucide-react)

### DB Schema Supabase
```sql
CREATE TABLE notification_types (
  id TEXT PRIMARY KEY, -- 'order.paid', 'invoice.overdue', 'deal.won', 'mention'
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'transactional', 'marketing', 'system'
  default_channels TEXT[] DEFAULT '{in_app}',
  is_user_configurable BOOLEAN DEFAULT true
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type_id TEXT NOT NULL REFERENCES notification_types(id),
  title TEXT NOT NULL,
  body TEXT,
  action_url TEXT,
  icon TEXT, -- emoji ou lucide name
  data JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  delivered_channels TEXT[] DEFAULT '{}',
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notification_preferences (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type_id TEXT NOT NULL REFERENCES notification_types(id),
  channels TEXT[] DEFAULT '{}', -- 'in_app', 'email', 'push_web', 'push_mobile', 'sms', 'telegram'
  enabled BOOLEAN DEFAULT true,
  PRIMARY KEY (user_id, type_id)
);

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX idx_notifs_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;

-- RLS
CREATE POLICY "notifs_own" ON notifications FOR ALL USING (user_id = auth.uid());
CREATE POLICY "prefs_own" ON notification_preferences FOR ALL USING (user_id = auth.uid());
```

### Notification dispatcher (Edge Function)
```ts
// /supabase/functions/send-notification/index.ts
import { createClient } from '@supabase/supabase-js';
import { Brevo } from 'brevo';
import webpush from 'web-push';

interface NotificationPayload {
  userId: string;
  typeId: string;
  title: string;
  body?: string;
  actionUrl?: string;
  data?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

Deno.serve(async (req) => {
  const payload = await req.json() as NotificationPayload;
  const supabase = createClient(/* service role */);
  
  // 1. Get user preferences for this type
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('channels, enabled')
    .eq('user_id', payload.userId)
    .eq('type_id', payload.typeId)
    .single();
  
  if (prefs && !prefs.enabled) return new Response('Skipped', { status: 200 });
  
  const channels = prefs?.channels ?? 
    (await supabase.from('notification_types').select('default_channels').eq('id', payload.typeId).single()).data?.default_channels ?? 
    ['in_app'];
  
  const delivered: string[] = [];
  
  // 2. in_app : insert into notifications table (trigger realtime)
  if (channels.includes('in_app')) {
    await supabase.from('notifications').insert({
      user_id: payload.userId,
      type_id: payload.typeId,
      title: payload.title,
      body: payload.body,
      action_url: payload.actionUrl,
      data: payload.data,
      priority: payload.priority ?? 'normal',
    });
    delivered.push('in_app');
  }
  
  // 3. Email
  if (channels.includes('email')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, locale')
      .eq('id', payload.userId)
      .single();
      
    if (profile?.email) {
      await resend.emails.send({
        from: 'notifications@propulseo.fr',
        to: profile.email,
        subject: payload.title,
        react: <NotificationEmail {...payload} locale={profile.locale} />,
      });
      delivered.push('email');
    }
  }
  
  // 4. Web push
  if (channels.includes('push_web')) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', payload.userId);
      
    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        }, JSON.stringify({ title: payload.title, body: payload.body, url: payload.actionUrl }));
      } catch (e) {
        if (e.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }
    delivered.push('push_web');
  }
  
  // 5. Telegram (admin only)
  if (channels.includes('telegram') && payload.priority === 'urgent') {
    await fetch(`https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/sendMessage`, {
      method: 'POST',
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_ADMIN_CHAT,
        text: `🚨 ${payload.title}\n${payload.body ?? ''}`,
      }),
    });
    delivered.push('telegram');
  }
  
  return new Response(JSON.stringify({ delivered }), { status: 200 });
});
```

### Server Action côté app
```ts
'use server'
export async function notify(userId: string, typeId: string, data: Omit<NotificationPayload, 'userId' | 'typeId'>) {
  // Fire-and-forget vers Edge Function pour ne pas bloquer caller
  const supabase = createServerClient();
  await supabase.functions.invoke('send-notification', {
    body: { userId, typeId, ...data },
  });
}
```

### Hook realtime in-app
```ts
'use client'
export function useNotifications() {
  const queryClient = useQueryClient();
  const supabase = createBrowserClient();
  
  useEffect(() => {
    const channel = supabase
      .channel('user-notifications')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          // Toast pour priority=high/urgent
          if (payload.new.priority === 'high' || payload.new.priority === 'urgent') {
            toast(payload.new.title, { description: payload.new.body });
          }
          // Play sound si paramétré
          if (notificationSettings.sound) playSound('notification.mp3');
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);
}
```

### UI Flow
```
[Bell icon header avec badge count]
  └ Click → Popover
      ├ Tabs Toutes | Non lues
      ├ ScrollArea : NotificationItem (icon | title | body | time relative | action btn)
      └ Footer : "Tout marquer lu" + lien /notifications

[/notifications page]
  └ Liste complète + filtres + archive

[/account/notifications-preferences]
  ├ Liste types groupés par category
  └ Par ligne : Type name + Switches in_app | email | push_web | push_mobile
```

### Edge Cases
- **User offline** : in_app via realtime se met à jour au reconnect (Supabase replay)
- **Push subscription expired** : 410 response → delete subscription
- **Email bounce** : Brevo webhook → disable email channel pour user
- **Spam multiple** : debounce server-side (1 notif/type/user/min)
- **Permissions push denied** : prompt one-time avec context métier

### Intégrations
- Brevo (email)
- web-push (browser push)
- Expo Push (mobile)
- Telegram Bot API
- Slack Incoming Webhooks (admin channel)
- SMS Twilio (urgent only)

## 4. ADAPTATION PLACEHOLDERS

- **`[METIER=mode/food/e-commerce]`** : order.paid, shipped, delivered, refund
- **`[METIER=SaaS]`** : trial_ending, payment_failed, feature_announced
- **`[METIER=CRM/agence]`** : deal.won, lead.assigned, meeting.reminder
- **`[METIER=santé/DocAgora]`** : appointment.confirmed, reminder_24h, no_show
- **`[CHANNELS]`** : whitelist par projet (SMS souvent désactivé pour coût)
- **`[DIGEST=daily/weekly/off]`** : email récap regroupé

## 5. ACCEPTANCE CRITERIA

- [ ] In-app notif visible <2s après trigger
- [ ] Préférences respectées (skip si user opted out)
- [ ] Bell count badge update realtime
- [ ] Email digest weekly fonctionne
- [ ] Push web : permission prompt en contexte
- [ ] Mobile push (si Expo) fonctionne iOS + Android
- [ ] Mark all read : optimistic + sync
- [ ] Anti-spam : max 1 notif/type/user/min
- [ ] Lighthouse > 95 (composants légers)
- [ ] RLS : user voit que ses notifs
- [ ] Archive 90j puis purge (cron)

## 6. TODO IMPLEMENTATION

1. **DB** : notification_types, notifications, preferences, push_subscriptions + RLS
2. **Seed** : insert notification_types pour ton projet
3. **Edge Function** : `send-notification` dispatcher multi-canal
4. **Server Action** : `notify(userId, typeId, payload)` wrapper invoke Edge
5. **Service Worker** : `/sw.js` pour push web (registerPushSubscription)
6. **Components** :
   - `<NotificationBell />` Popover header
   - `<NotificationItem />` avec mark-read
   - `<NotificationPreferences />` settings page
   - `<PushPermissionPrompt />` contextuel
7. **Email templates** : React Email + Brevo
8. **Cron** : weekly digest, archive purge, expired subs cleanup

## 7. CODE SKELETON

```tsx
// /components/layout/notification-bell.tsx
'use client'
import { Bell } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/hooks/use-notifications';

export function NotificationBell() {
  useNotifications(); // subscribe realtime
  const { data: notifs = [] } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => fetchNotifications({ unreadOnly: true, limit: 20 }),
  });
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notifs.length > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center">
              {notifs.length > 9 ? '9+' : notifs.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <Button variant="ghost" size="sm" onClick={markAllRead}>
            Tout marquer lu
          </Button>
        </div>
        <ScrollArea className="h-96">
          {notifs.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Aucune notification
            </p>
          ) : (
            notifs.map(n => <NotificationItem key={n.id} notif={n} />)
          )}
        </ScrollArea>
        <Link href="/notifications" className="block p-3 text-center text-sm border-t hover:bg-muted">
          Voir toutes
        </Link>
      </PopoverContent>
    </Popover>
  );
}
```

## 8. NOTES SENIOR / GOTCHAS

- ❌ **NE PAS** envoyer email pour CHAQUE event → digest pour notifs basse priorité
- ❌ **NE PAS** demander permission push au load → contexte (post-action utilisateur)
- ❌ **NE PAS** stocker action_url avec hostname prod hardcodé → relative URL
- ⚠️ Realtime channel : unique par user, cleanup au signout obligatoire
- ⚠️ Push subscription : VAPID keys stables (sinon tous tokens invalidés au deploy)
- ⚠️ Email volume : Brevo limits (free 300/jour, Pro plans) → batch ou self-host SES
- ⚠️ iOS Safari push : iOS 16.4+ + PWA installée requise
- ✅ Toast Sonner pour high/urgent ; pas pour normal/low
- ✅ Sound notification = option user (default off)
- ✅ Upgrade 2026 : Smart routing AI — Claude détermine channel optimal selon historique user (open rate email vs push)
- ✅ Upgrade 2026 : "Snooze" notif jusqu'à demain matin (UX type Slack)
