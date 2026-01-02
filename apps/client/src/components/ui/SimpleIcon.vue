<template>
  <component :is="iconComponent" :size="size" :class="['icon', `icon-${name}`]" />
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import {
    Mic,
    MicOff,
    Video,
    VideoOff,
    PhoneOff,
    Monitor,
    Circle,
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
    MoreVertical,
    X,
    Settings,
    Users,
    UserPlus,
    UserX,
    Crown,
    MessageCircle,
    Send,
    CornerUpLeft,
    Smile,
    Volume2,
    Layout,
    Grid3X3,
    Presentation,
    Pin,
    Sparkles,
    Edit,
    Trash2,
    Paperclip,
    Zap,
    BarChart3,
    Info,
    Flag,
    Keyboard,
    Type,
    Lock,
    Clock,
  } from 'lucide-vue-next'

  const props = withDefaults(
    defineProps<{
      name: string
      size?: number
    }>(),
    {
      size: 24,
    }
  )

  const iconMap = {
    // Communication
    mic: Mic,
    'mic-off': MicOff,
    video: Video,
    'video-off': VideoOff,
    'phone-off': PhoneOff,
    'screen-share': Monitor,
    record: Circle,

    // Navigation
    'chevron-left': ChevronLeft,
    'chevron-right': ChevronRight,
    'more-horizontal': MoreHorizontal,
    'more-vertical': MoreVertical,
    x: X,
    settings: Settings,

    // People
    people: Users,
    users: Users,
    'user-plus': UserPlus,
    'user-x': UserX,
    crown: Crown,

    // Chat
    chat: MessageCircle,
    'message-circle': MessageCircle,
    send: Send,
    reply: CornerUpLeft,

    // Emotions
    smile: Smile,
    volume: Volume2,

    // Layout
    layout: Layout,
    grid: Grid3X3,
    speaker: Volume2,
    presentation: Presentation,
    pin: Pin,

    // Actions
    effects: Sparkles,
    edit: Edit,
    trash: Trash2,
    paperclip: Paperclip,
    spotlight: Zap,
    poll: BarChart3,

    // Status
    info: Info,
    flag: Flag,
    keyboard: Keyboard,
    captions: Type,
    lock: Lock,
    clock: Clock,
  }

  const iconComponent = computed(() => {
    const component = iconMap[props.name as keyof typeof iconMap]
    if (!component) {
      console.warn(`Icon "${props.name}" not found, using default`)
      return Circle // fallback icon
    }
    return component
  })
</script>

<style scoped>
  .icon {
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
  }
</style>
