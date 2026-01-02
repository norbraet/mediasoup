<template>
  <div class="video-grid" :class="[`layout-${layout}`, { 'has-pinned': pinnedParticipant }]">
    <!-- Main Video Area -->
    <div class="main-video-area">
      <template v-if="layout === 'presentation' && presentingParticipant">
        <VideoParticipant
          :participant="presentingParticipant"
          :is-main="true"
          :is-pinned="false"
          class="presentation-video"
          @pin="$emit('pin-participant', $event)"
          @toggle-menu="$emit('toggle-participant-menu', $event)"
        />
      </template>

      <template v-else-if="layout === 'speaker' && (pinnedParticipant || mainSpeaker)">
        <VideoParticipant
          :participant="pinnedParticipant ? getPinnedParticipant() : mainSpeaker"
          :is-main="true"
          :is-pinned="!!pinnedParticipant"
          class="speaker-video"
          @pin="$emit('pin-participant', $event)"
          @toggle-menu="$emit('toggle-participant-menu', $event)"
        />
      </template>

      <template v-else>
        <!-- Grid Layout -->
        <div
          class="participants-grid"
          :class="`grid-${gridCols}x${gridRows}`"
          :style="{
            '--grid-cols': gridCols,
            '--grid-rows': gridRows,
          }"
        >
          <VideoParticipant
            v-for="participant in visibleParticipants"
            :key="participant.id"
            :participant="participant"
            :is-main="false"
            :is-pinned="participant.id === pinnedParticipant"
            @pin="$emit('pin-participant', $event)"
            @toggle-menu="$emit('toggle-participant-menu', $event)"
          />
        </div>
      </template>
    </div>

    <!-- Secondary Video Strip (for presentation/speaker layouts) -->
    <div v-if="layout !== 'grid' && secondaryParticipants.length > 0" class="secondary-video-strip">
      <div class="secondary-videos">
        <VideoParticipant
          v-for="participant in secondaryParticipants"
          :key="participant.id"
          :participant="participant"
          :is-main="false"
          :is-pinned="false"
          class="secondary-video"
          @pin="$emit('pin-participant', $event)"
          @toggle-menu="$emit('toggle-participant-menu', $event)"
        />
      </div>

      <!-- Scroll buttons for secondary strip -->
      <button v-if="canScrollLeft" class="scroll-btn scroll-left" @click="scrollSecondary('left')">
        <SimpleIcon name="chevron-left" />
      </button>

      <button
        v-if="canScrollRight"
        class="scroll-btn scroll-right"
        @click="scrollSecondary('right')"
      >
        <SimpleIcon name="chevron-right" />
      </button>
    </div>

    <!-- Pagination for grid -->
    <div v-if="layout === 'grid' && totalPages > 1" class="pagination">
      <button class="pagination-btn" :disabled="currentPage === 1" @click="currentPage--">
        <SimpleIcon name="chevron-left" />
      </button>

      <span class="page-info"> {{ currentPage }} / {{ totalPages }} </span>

      <button class="pagination-btn" :disabled="currentPage === totalPages" @click="currentPage++">
        <SimpleIcon name="chevron-right" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import VideoParticipant from './VideoParticipant.vue'
  import SimpleIcon from '@/components/ui/SimpleIcon.vue'

  interface Participant {
    id: string
    name: string
    isAudioMuted: boolean
    isVideoOff: boolean
    isPresenting: boolean
    isHost: boolean
    stream?: MediaStream
  }

  const props = defineProps<{
    participants: Participant[]
    layout: 'grid' | 'speaker' | 'presentation'
    pinnedParticipant?: string | null
  }>()

  defineEmits<{
    'pin-participant': [id: string]
    'toggle-participant-menu': [
      data: { participant: Participant; position: { x: number; y: number } },
    ]
  }>()

  // State
  const currentPage = ref(1)
  const secondaryScrollOffset = ref(0)

  // Constants
  const PARTICIPANTS_PER_PAGE = 16
  const SECONDARY_VISIBLE_COUNT = 6

  // Computed
  const presentingParticipant = computed(() => props.participants.find((p) => p.isPresenting))

  const mainSpeaker = computed(
    () =>
      props.participants.find((p) => !p.isAudioMuted && !p.isPresenting) || props.participants[0]
  )

  const getPinnedParticipant = () =>
    props.participants.find((p) => p.id === props.pinnedParticipant)

  const visibleParticipants = computed(() => {
    if (props.layout === 'grid') {
      const startIndex = (currentPage.value - 1) * PARTICIPANTS_PER_PAGE
      return props.participants.slice(startIndex, startIndex + PARTICIPANTS_PER_PAGE)
    }
    return props.participants
  })

  const secondaryParticipants = computed(() => {
    if (props.layout === 'presentation' && presentingParticipant.value) {
      return props.participants
        .filter((p) => p.id !== presentingParticipant.value!.id)
        .slice(secondaryScrollOffset.value, secondaryScrollOffset.value + SECONDARY_VISIBLE_COUNT)
    }

    if (props.layout === 'speaker') {
      const mainId = props.pinnedParticipant || mainSpeaker.value?.id
      return props.participants
        .filter((p) => p.id !== mainId)
        .slice(secondaryScrollOffset.value, secondaryScrollOffset.value + SECONDARY_VISIBLE_COUNT)
    }

    return []
  })

  const gridCols = computed(() => {
    const count = visibleParticipants.value.length
    if (count <= 1) return 1
    if (count <= 4) return 2
    if (count <= 9) return 3
    if (count <= 16) return 4
    return 4
  })

  const gridRows = computed(() => {
    const count = visibleParticipants.value.length
    return Math.ceil(count / gridCols.value)
  })

  const totalPages = computed(() => Math.ceil(props.participants.length / PARTICIPANTS_PER_PAGE))

  const canScrollLeft = computed(() => secondaryScrollOffset.value > 0)

  const canScrollRight = computed(() => {
    const totalSecondary =
      props.layout === 'presentation'
        ? props.participants.filter((p) => !p.isPresenting).length
        : props.participants.length - 1
    return secondaryScrollOffset.value + SECONDARY_VISIBLE_COUNT < totalSecondary
  })

  // Methods
  const scrollSecondary = (direction: 'left' | 'right') => {
    if (direction === 'left' && canScrollLeft.value) {
      secondaryScrollOffset.value = Math.max(0, secondaryScrollOffset.value - 1)
    } else if (direction === 'right' && canScrollRight.value) {
      secondaryScrollOffset.value += 1
    }
  }
</script>

<style scoped>
  .video-grid {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #1a1a1a;
    position: relative;
  }

  .main-video-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  /* Grid Layout */
  .participants-grid {
    display: grid;
    gap: 8px;
    width: 100%;
    height: 100%;
    grid-template-columns: repeat(var(--grid-cols), 1fr);
    grid-template-rows: repeat(var(--grid-rows), 1fr);
  }

  /* Speaker/Presentation Layouts */
  .presentation-video,
  .speaker-video {
    width: 100%;
    height: 100%;
    max-height: calc(100vh - 200px);
  }

  .layout-presentation .main-video-area,
  .layout-speaker .main-video-area {
    height: calc(100% - 120px);
  }

  /* Secondary Video Strip */
  .secondary-video-strip {
    height: 120px;
    background: #2d2d2d;
    border-top: 1px solid #404040;
    position: relative;
    display: flex;
    align-items: center;
  }

  .secondary-videos {
    display: flex;
    gap: 8px;
    padding: 16px;
    overflow: hidden;
    flex: 1;
  }

  .secondary-video {
    flex: 0 0 160px;
    height: 90px;
  }

  .scroll-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.7);
    border: none;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    transition: background-color 0.2s;
  }

  .scroll-btn:hover {
    background: rgba(0, 0, 0, 0.9);
  }

  .scroll-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .scroll-left {
    left: 8px;
  }

  .scroll-right {
    right: 8px;
  }

  /* Pagination */
  .pagination {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(0, 0, 0, 0.7);
    padding: 8px 16px;
    border-radius: 20px;
    backdrop-filter: blur(10px);
  }

  .pagination-btn {
    background: none;
    border: none;
    color: white;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .pagination-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }

  .pagination-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .page-info {
    color: white;
    font-size: 14px;
    white-space: nowrap;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .main-video-area {
      padding: 8px;
    }

    .participants-grid {
      gap: 4px;
    }

    .secondary-video-strip {
      height: 100px;
    }

    .secondary-video {
      flex: 0 0 120px;
      height: 70px;
    }

    .layout-presentation .main-video-area,
    .layout-speaker .main-video-area {
      height: calc(100% - 100px);
    }
  }

  @media (max-width: 480px) {
    .participants-grid {
      grid-template-columns: repeat(2, 1fr) !important;
    }

    .secondary-videos {
      padding: 8px;
    }

    .secondary-video {
      flex: 0 0 100px;
      height: 60px;
    }
  }
</style>
