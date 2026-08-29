import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import {
  aggregateCrowdRankings,
  buildCrowdLeague,
  scoreCrowdBoard,
  type CrowdRankingsResult,
  type CrowdVote,
} from './crowdRankings'
import type { League } from './types'

export function useCrowdRankings(
  leagueId: string | null | undefined,
  userId: string | null | undefined,
  baseLeague: League,
  refreshKey: string,
  enabled: boolean,
) {
  const [contributorCount, setContributorCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [crowdResult, setCrowdResult] = useState<CrowdRankingsResult | null>(null)

  const refetch = useCallback(async () => {
    if (!leagueId || !userId || !enabled) {
      setCrowdResult(null)
      setContributorCount(0)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('fetch_league_crowd_ranking_votes' as never, {
        p_league_id: leagueId,
      })

      if (error || !data || typeof data !== 'object') {
        setCrowdResult(null)
        setContributorCount(0)
        return
      }

      const votes = (data as { votes?: CrowdVote[] }).votes ?? []
      const crowd = aggregateCrowdRankings(votes, baseLeague.teams.length)
      if (!crowd) {
        setCrowdResult(null)
        setContributorCount(0)
        return
      }

      setContributorCount(crowd.contributorCount)
      setCrowdResult(crowd)
    } finally {
      setLoading(false)
    }
  }, [baseLeague.teams.length, enabled, leagueId, userId])

  useEffect(() => {
    void refetch()
  }, [refetch, refreshKey])

  const crowdLeague = useMemo(
    () => (crowdResult ? buildCrowdLeague(baseLeague, crowdResult) : null),
    [baseLeague, crowdResult],
  )

  const crowdBoard = useMemo(
    () => (crowdResult ? scoreCrowdBoard(baseLeague, crowdResult) : []),
    [baseLeague, crowdResult],
  )

  return {
    crowdLeague,
    crowdBoard,
    contributorCount,
    loading,
    refetch,
  }
}

