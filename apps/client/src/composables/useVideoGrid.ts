import { computed, type Ref } from 'vue'

interface GridConfig {
  columns: number
  rows: number
  aspectRatio: string
}

export function useVideoGrid(participantCount: Ref<number>) {
  const gridConfig = computed((): GridConfig => {
    const count = participantCount.value

    if (count === 0) {
      return { columns: 1, rows: 1, aspectRatio: '16/9' }
    }

    if (count === 1) {
      // Single participant - use most of the screen
      return { columns: 1, rows: 1, aspectRatio: '16/9' }
    }

    if (count === 2) {
      // Two participants - side by side
      return { columns: 2, rows: 1, aspectRatio: '16/9' }
    }

    if (count <= 4) {
      // 3-4 participants - 2x2 grid
      return { columns: 2, rows: 2, aspectRatio: '4/3' }
    }

    if (count <= 6) {
      // 5-6 participants - 3x2 grid
      return { columns: 3, rows: 2, aspectRatio: '4/3' }
    }

    if (count <= 9) {
      // 7-9 participants - 3x3 grid
      return { columns: 3, rows: 3, aspectRatio: '1/1' }
    }

    if (count <= 12) {
      // 10-12 participants - 4x3 grid
      return { columns: 4, rows: 3, aspectRatio: '4/3' }
    }

    if (count <= 16) {
      // 13-16 participants - 4x4 grid
      return { columns: 4, rows: 4, aspectRatio: '1/1' }
    }

    if (count <= 20) {
      // 17-20 participants - 5x4 grid
      return { columns: 5, rows: 4, aspectRatio: '4/3' }
    }

    // 21+ participants - 6x5 grid (or calculate dynamically)
    const optimalCols = Math.ceil(Math.sqrt(count))
    const optimalRows = Math.ceil(count / optimalCols)

    return {
      columns: Math.min(optimalCols, 6),
      rows: Math.min(optimalRows, 5),
      aspectRatio: '4/3',
    }
  })

  return {
    gridConfig,
  }
}
