package dashen.bank.boivs.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "bo_sequence")
@Getter
@Setter
@NoArgsConstructor
public class BoSequence {

    @Id
    @Column(name = "seq_year")
    private Integer seqYear;

    @Column(name = "last_value", nullable = false)
    private Integer lastValue;
}
